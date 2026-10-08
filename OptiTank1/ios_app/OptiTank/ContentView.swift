import SwiftUI

struct ContentView: View {
    @StateObject private var model = WebViewModel()
    private let appURL = URL(string: "https://optitank.online?app=1")!
    
    // Ensure splash plays for at least 4.2 seconds
    @State private var minSplashTimeElapsed = false

    var body: some View {
        ZStack(alignment: .bottom) {
            Color(hex: "0C0B1E").ignoresSafeArea()

            WebView(model: model, url: appURL)
                .ignoresSafeArea(edges: .bottom)

            // The animated Launch Screen matching the HTML version
            if model.isLoading || !minSplashTimeElapsed {
                LoadingSplash {
                    minSplashTimeElapsed = true
                }
                .transition(.opacity.combined(with: .scale(scale: 1.05)))
                .zIndex(10)
            }
        }
        .animation(.easeInOut(duration: 0.8), value: model.isLoading || !minSplashTimeElapsed)

        .onOpenURL { url in
            guard url.scheme == "optitank" else { return }
            if url.host == "station",
               let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
               let stationId = comps.queryItems?.first(where: { $0.name == "id" })?.value,
               !stationId.isEmpty {
                model.openDeepLink(stationId: stationId)
            }
        }
    }
}

// MARK: - Loading splash screen
struct LoadingSplash: View {
    // ── Animation states ────────────────────────
    @State private var ringTrim:         CGFloat = 0
    @State private var dotScale:         CGFloat = 0
    @State private var tOpacity:         CGFloat = 0
    @State private var tOffset:          CGFloat = 28
    @State private var wordmarkOpacity:  CGFloat = 0
    @State private var wordmarkOffset:   CGFloat = 10
    @State private var loaderOpacity:    CGFloat = 0
    @State private var loaderWidth:      CGFloat = 0

    // ── Layout constants ────────────────────────
    private let oFrame:           CGFloat = 170   // frame du cercle O
    private let oStroke:          CGFloat = 52    // épaisseur anneau O
    private let tBarW:            CGFloat = 134   // largeur barre T
    private let tBarH:            CGFloat = 34    // hauteur barre T
    private let tStemW:           CGFloat = 34    // largeur tige T
    private let tStemH:           CGFloat = 90    // hauteur tige T
    private let dotDiameter:      CGFloat = 12    // point teal
    private let loaderTotalW:     CGFloat = 120   // loader bar

    // Callback appelé quand le splash est terminé
    var onComplete: (() -> Void)?

    var body: some View {
        ZStack {

            // ── Fond
            Color(hex: "0C0B1E")
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // ── Logo
                VStack(spacing: 0) {

                    // O — anneau qui se dessine
                    Circle()
                        .trim(from: 0, to: ringTrim)
                        .stroke(
                            Color.white,
                            style: StrokeStyle(
                                lineWidth: oStroke,
                                lineCap: .round
                            )
                        )
                        .frame(width: oFrame, height: oFrame)
                        .rotationEffect(.degrees(-90)) // départ depuis 12h

                    // Point séparateur teal
                    Circle()
                        .fill(Color(hex: "00D4AA"))
                        .frame(width: dotDiameter, height: dotDiameter)
                        .scaleEffect(dotScale)
                        .padding(.top, 14)

                    // T — barre + tige
                    VStack(spacing: 0) {
                        Rectangle()
                            .fill(Color.white)
                            .frame(width: tBarW, height: tBarH)
                        Rectangle()
                            .fill(Color.white)
                            .frame(width: tStemW, height: tStemH)
                    }
                    .padding(.top, 10)
                    .opacity(tOpacity)
                    .offset(y: tOffset)
                }

                // ── Wordmark
                VStack(spacing: 7) {
                    HStack(spacing: 0) {
                        Text("Opti")
                            .foregroundColor(.white)
                        Text("Tank")
                            .foregroundColor(Color(hex: "00D4AA"))
                    }
                    .font(.system(size: 30, weight: .heavy))
                    .tracking(-1.2)

                    Text("Carburant intelligent · Suisse")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.white.opacity(0.28))
                }
                .opacity(wordmarkOpacity)
                .offset(y: wordmarkOffset)
                .padding(.top, 30)

                Spacer()

                // ── Barre de chargement
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 99)
                        .fill(Color.white.opacity(0.08))
                        .frame(width: loaderTotalW, height: 3)

                    RoundedRectangle(cornerRadius: 99)
                        .fill(Color(hex: "00D4AA"))
                        .frame(width: loaderWidth, height: 3)
                }
                .opacity(loaderOpacity)
                .padding(.bottom, 72)
            }
        }
        .onAppear { startAnimation() }
    }

    // ── Séquence ─────────────────────────────────
    private func startAnimation() {

        // 1 — O se dessine
        withAnimation(.easeInOut(duration: 0.9).delay(0.35)) {
            ringTrim = 1
        }

        // 2 — Point teal
        withAnimation(
            .spring(response: 0.38, dampingFraction: 0.52)
            .delay(1.15)
        ) {
            dotScale = 1
        }

        // 3 — T monte
        withAnimation(
            .spring(response: 0.46, dampingFraction: 0.70)
            .delay(1.30)
        ) {
            tOpacity = 1
            tOffset  = 0
        }

        // 4 — Wordmark
        withAnimation(.easeOut(duration: 0.5).delay(1.90)) {
            wordmarkOpacity = 1
            wordmarkOffset  = 0
        }

        // 5 — Loader apparaît
        withAnimation(.easeOut(duration: 0.3).delay(2.30)) {
            loaderOpacity = 1
        }

        // 6 — Loader se remplit → appelle onComplete
        withAnimation(.easeInOut(duration: 1.4).delay(2.50)) {
            loaderWidth = loaderTotalW
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4.1) {
            onComplete?()
        }
    }
}



// MARK: - Color from hex string
extension Color {
    init(hex: String) {
        var int: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)).scanHexInt64(&int)
        self.init(
            red:   Double((int >> 16) & 0xFF) / 255,
            green: Double((int >>  8) & 0xFF) / 255,
            blue:  Double( int        & 0xFF) / 255
        )
    }
}
