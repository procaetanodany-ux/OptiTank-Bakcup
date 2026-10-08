import UIKit
import AuthenticationServices
import CryptoKit

// Connexion Apple / Google native.
// La page web tourne dans une WKWebView : les popups OAuth n'y fonctionnent pas et
// Google refuse toute connexion dans une vue web intégrée (403 disallowed_useragent).
// On récupère donc l'idToken ici et la page appelle signInWithCredential() avec.
final class NativeAuth: NSObject {
    static let shared = NativeAuth()

    enum AuthError: LocalizedError {
        case cancelled
        case failed(String)

        var errorDescription: String? {
            switch self {
            case .cancelled: return "cancelled"
            case .failed(let message): return message
            }
        }
    }

    typealias Completion = (Result<[String: String], AuthError>) -> Void

    private var appleCompletion: Completion?
    private var appleNonce: String?
    private var googleSession: ASWebAuthenticationSession?

    // MARK: - Apple

    func signInWithApple(completion: @escaping Completion) {
        let nonce = Self.randomString(length: 32)
        appleNonce = nonce
        appleCompletion = completion

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    // MARK: - Google (OAuth 2.0 + PKCE avec le client iOS de GoogleService-Info.plist)

    func signInWithGoogle(completion: @escaping Completion) {
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let info = NSDictionary(contentsOfFile: path),
              let clientID = info["CLIENT_ID"] as? String,
              let scheme = info["REVERSED_CLIENT_ID"] as? String else {
            completion(.failure(.failed("Configuration Google manquante")))
            return
        }

        let redirectURI = "\(scheme):/oauth2redirect"
        let verifier = Self.randomString(length: 64)
        let challenge = Self.base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        let state = Self.randomString(length: 24)

        var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: "openid email profile"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state),
            URLQueryItem(name: "prompt", value: "select_account"),
        ]

        let session = ASWebAuthenticationSession(url: components.url!, callbackURLScheme: scheme) { [weak self] callbackURL, error in
            self?.googleSession = nil
            if let error = error {
                if (error as? ASWebAuthenticationSessionError)?.code == .canceledLogin {
                    completion(.failure(.cancelled))
                } else {
                    completion(.failure(.failed(error.localizedDescription)))
                }
                return
            }
            let items = callbackURL.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false)?.queryItems } ?? []
            guard items.first(where: { $0.name == "state" })?.value == state,
                  let code = items.first(where: { $0.name == "code" })?.value else {
                completion(.failure(.failed("Réponse Google invalide")))
                return
            }
            Self.exchangeGoogleCode(code, clientID: clientID, redirectURI: redirectURI, verifier: verifier, completion: completion)
        }
        session.presentationContextProvider = self
        googleSession = session
        if !session.start() {
            googleSession = nil
            completion(.failure(.failed("Impossible d'ouvrir la connexion Google")))
        }
    }

    private static func exchangeGoogleCode(_ code: String, clientID: String, redirectURI: String, verifier: String, completion: @escaping Completion) {
        var body = URLComponents()
        body.queryItems = [
            URLQueryItem(name: "code", value: code),
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "code_verifier", value: verifier),
            URLQueryItem(name: "grant_type", value: "authorization_code"),
        ]
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = body.percentEncodedQuery?.data(using: .utf8)

        URLSession.shared.dataTask(with: request) { data, _, error in
            if let error = error {
                completion(.failure(.failed(error.localizedDescription)))
                return
            }
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let idToken = json["id_token"] as? String else {
                completion(.failure(.failed("Échange du code Google impossible")))
                return
            }
            completion(.success(["idToken": idToken]))
        }.resume()
    }

    // MARK: - Helpers

    private static func randomString(length: Int) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._~")
        var generator = SystemRandomNumberGenerator()
        return String((0..<length).map { _ in charset.randomElement(using: &generator)! })
    }

    private static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

extension NativeAuth: ASAuthorizationControllerDelegate {
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        let completion = appleCompletion
        appleCompletion = nil
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let idToken = String(data: tokenData, encoding: .utf8),
              let nonce = appleNonce else {
            completion?(.failure(.failed("Jeton Apple manquant")))
            return
        }
        var result = ["idToken": idToken, "rawNonce": nonce]
        // Apple ne transmet le nom qu'à la toute première connexion.
        if let fullName = credential.fullName {
            let name = PersonNameComponentsFormatter().string(from: fullName)
            if !name.isEmpty { result["displayName"] = name }
        }
        completion?(.success(result))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let completion = appleCompletion
        appleCompletion = nil
        if (error as? ASAuthorizationError)?.code == .canceled {
            completion?(.failure(.cancelled))
        } else {
            completion?(.failure(.failed(error.localizedDescription)))
        }
    }
}

extension NativeAuth: ASAuthorizationControllerPresentationContextProviding, ASWebAuthenticationPresentationContextProviding {
    private var anchor: ASPresentationAnchor {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
        return windows.first(where: { $0.isKeyWindow }) ?? windows.first ?? ASPresentationAnchor()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { anchor }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { anchor }
}
