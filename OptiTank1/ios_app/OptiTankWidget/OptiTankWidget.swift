import WidgetKit
import SwiftUI

// MARK: - Compat helper (containerBackground iOS 17+, background iOS 16)
private extension View {
    @ViewBuilder
    func widgetBg(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(color, for: .widget)
        } else {
            self.background(color)
        }
    }
}

// MARK: - Colors
private extension Color {
    static let otPurple = Color(red: 0.545, green: 0.361, blue: 0.965)
    static let otTeal   = Color(red: 0.000, green: 0.831, blue: 0.667)
    static let otGreen  = Color(red: 0.133, green: 0.773, blue: 0.369)
    static let otBg     = Color(red: 0.055, green: 0.055, blue: 0.071)
    static let otBgCard = Color(red: 0.075, green: 0.075, blue: 0.102)
    static let otBorder = Color.white.opacity(0.08)
}

// MARK: - Sparkline
struct SparklineView: View {
    let data: [Double]
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let mn = data.min() ?? 1.7
            let mx = data.max() ?? 2.0
            let range = mx - mn > 0 ? mx - mn : 0.1
            let pts = data.enumerated().map { i, v in
                CGPoint(
                    x: CGFloat(i) * (w / CGFloat(max(data.count - 1, 1))),
                    y: h - CGFloat((v - mn) / range) * h * 0.8 - h * 0.1
                )
            }
            // Area fill
            if pts.count > 1 {
                Path { p in
                    p.move(to: CGPoint(x: pts[0].x, y: h))
                    for pt in pts { p.addLine(to: pt) }
                    p.addLine(to: CGPoint(x: pts.last!.x, y: h))
                    p.closeSubpath()
                }
                .fill(LinearGradient(
                    colors: [Color.otTeal.opacity(0.28), Color.otTeal.opacity(0)],
                    startPoint: .top, endPoint: .bottom
                ))
                // Line
                Path { p in
                    p.move(to: pts[0])
                    for pt in pts.dropFirst() { p.addLine(to: pt) }
                }
                .stroke(Color.otTeal, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            }
            // Last dot
            if let last = pts.last {
                Circle().fill(Color.otTeal).frame(width: 7, height: 7).position(last)
                Circle().fill(Color.white.opacity(0.6)).frame(width: 3, height: 3).position(last)
            }
        }
    }
}

// MARK: - Small (2×2) — Meilleur prix 25 km
struct SmallWidgetView: View {
    let entry: WidgetEntry
    var body: some View {
        ZStack(alignment: .bottom) {
            Circle().fill(Color.otGreen.opacity(0.12)).frame(width: 90).offset(x: 40, y: -40)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(entry.data.fuelType)
                        .font(.system(size: 10, weight: .bold)).foregroundColor(.white.opacity(0.45))
                        .textCase(.uppercase).kerning(0.5)
                    Spacer()
                    Image(systemName: "fuelpump.fill")
                        .foregroundColor(Color.otGreen).font(.system(size: 13))
                }
                Spacer()
                Text(entry.data.bestPrice)
                    .font(.system(size: 44, weight: .black, design: .rounded))
                    .foregroundColor(.white).lineLimit(1).minimumScaleFactor(0.65)
                Text("CHF / litre")
                    .font(.system(size: 10, weight: .semibold)).foregroundColor(.white.opacity(0.4))
                Spacer()
                Divider().background(Color.otBorder)
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(entry.data.stationName)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.white.opacity(0.75)).lineLimit(1)
                        Text("\(entry.data.distance) km · 25 km")
                            .font(.system(size: 10, weight: .bold)).foregroundColor(Color.otGreen)
                    }
                    Spacer()
                }
            }
            .padding(14)
        }
        .widgetBg(Color.otBg)
        .widgetURL(URL(string: "optitank://radar"))
    }
}

// MARK: - Medium (4×2)
struct MediumWidgetView: View {
    let entry: WidgetEntry
    var body: some View {
        ZStack {
            HStack(spacing: 0) {
                // Left — big price
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 4) {
                        Image(systemName: "fuelpump.fill").foregroundColor(Color.otPurple).font(.system(size: 11))
                        Text("Meilleur \(entry.data.fuelType)")
                            .font(.system(size: 10, weight: .bold)).foregroundColor(.white.opacity(0.45))
                            .textCase(.uppercase).kerning(0.4)
                    }
                    Spacer()
                    Text(entry.data.bestPrice)
                        .font(.system(size: 46, weight: .black, design: .rounded))
                        .foregroundColor(Color.otGreen).lineLimit(1).minimumScaleFactor(0.6).monospacedDigit()
                    Text("\(entry.data.stationName) · \(entry.data.distance) km")
                        .font(.system(size: 10, weight: .semibold)).foregroundColor(.white.opacity(0.45)).lineLimit(1)
                    Spacer()
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.down.circle.fill").foregroundColor(Color.otGreen).font(.system(size: 10))
                        Text("Meilleur prix 🇨🇭").font(.system(size: 10, weight: .bold)).foregroundColor(Color.otGreen)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Color.otGreen.opacity(0.12)).cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.otGreen.opacity(0.3), lineWidth: 1))
                }
                .padding(14).frame(maxWidth: .infinity)

                Rectangle().fill(Color.otBorder).frame(width: 1).padding(.vertical, 12)

                // Right — favoris si présents, sinon meilleures stations
                let rightList = entry.data.favorites.isEmpty ? entry.data.stations : entry.data.favorites
                let rightTitle = entry.data.favorites.isEmpty ? "Proches" : "Favoris"
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 4) {
                        if !entry.data.favorites.isEmpty {
                            Image(systemName: "heart.fill")
                                .font(.system(size: 8)).foregroundColor(Color(red: 0.94, green: 0.27, blue: 0.27))
                        }
                        Text(rightTitle)
                            .font(.system(size: 9, weight: .bold)).foregroundColor(.white.opacity(0.4))
                            .textCase(.uppercase).kerning(0.4)
                    }
                    .padding(.bottom, 6)
                    ForEach(Array(rightList.prefix(3).enumerated()), id: \.offset) { i, s in
                        HStack(spacing: 6) {
                            Circle()
                                .fill(i == 0 ? Color.otGreen : i == 1 ? Color.otTeal : Color.otPurple.opacity(0.7))
                                .frame(width: 5, height: 5)
                            Text(s.name).font(.system(size: 10, weight: .semibold)).foregroundColor(.white).lineLimit(1)
                            Spacer()
                            Text("CHF \(s.price)").font(.system(size: 11, weight: .bold)).monospacedDigit()
                                .foregroundColor(i == 0 ? Color.otGreen : .white.opacity(0.7))
                        }
                        .padding(.vertical, 4).padding(.horizontal, 6)
                        .background(i == 0 ? Color.otGreen.opacity(0.1) : Color.clear).cornerRadius(7)
                    }
                    Spacer()
                }
                .padding(.horizontal, 10).padding(.vertical, 14).frame(maxWidth: .infinity)
            }
        }
        .widgetBg(Color.otBg)
        .widgetURL(URL(string: "optitank://radar"))
    }
}

// MARK: - Large (4×4)
struct LargeWidgetView: View {
    let entry: WidgetEntry
    private var spark: [Double] {
        entry.data.priceHistory.isEmpty ? [1.95, 1.90, 1.84, 1.78, 1.75, 1.73, 1.720] : entry.data.priceHistory
    }
    var body: some View {
        ZStack {
            Circle().fill(Color.otPurple.opacity(0.12)).frame(width: 120).offset(x: 80, y: -60)
            Circle().fill(Color.otTeal.opacity(0.08)).frame(width: 80).offset(x: -60, y: 80)
            VStack(alignment: .leading, spacing: 10) {
                // Header
                HStack {
                    Image(systemName: "fuelpump.fill").foregroundColor(Color.otPurple).font(.system(size: 14))
                    VStack(alignment: .leading, spacing: 1) {
                        Text("OptiTank")
                            .font(.system(size: 13, weight: .black, design: .rounded)).foregroundColor(.white)
                        Text("Radar IA · \(entry.data.fuelType)")
                            .font(.system(size: 9, weight: .semibold)).foregroundColor(.white.opacity(0.4)).textCase(.uppercase)
                    }
                    Spacer()
                }
                // Best price card
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Meilleur prix").font(.system(size: 9, weight: .bold)).foregroundColor(.white.opacity(0.4)).textCase(.uppercase)
                        Text(entry.data.bestPrice)
                            .font(.system(size: 42, weight: .black, design: .rounded))
                            .foregroundColor(Color.otGreen).monospacedDigit()
                        Text("\(entry.data.stationName) · \(entry.data.distance) km")
                            .font(.system(size: 10, weight: .semibold)).foregroundColor(.white.opacity(0.45))
                    }
                    Spacer()
                }
                .padding(12)
                .background(LinearGradient(colors: [Color.otPurple.opacity(0.12), Color.otTeal.opacity(0.06)], startPoint: .leading, endPoint: .trailing))
                .cornerRadius(14)
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.otPurple.opacity(0.2), lineWidth: 1))
                // Sparkline
                VStack(alignment: .leading, spacing: 5) {
                    HStack {
                        Text("Évolution 7 jours").font(.system(size: 9, weight: .bold)).foregroundColor(.white.opacity(0.4)).textCase(.uppercase)
                        Spacer()
                        let diff = (spark.last ?? 1.72) - (spark.first ?? 1.95)
                        Text(String(format: "%+.3f CHF/L", diff))
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(diff < 0 ? Color.otGreen : Color(red: 0.94, green: 0.29, blue: 0.27))
                    }
                    SparklineView(data: spark).frame(height: 38)
                }
                .padding(10)
                .background(Color.otBgCard).cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.otBorder, lineWidth: 1))
                // Favoris (si présents)
                if !entry.data.favorites.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 4) {
                            Image(systemName: "heart.fill").font(.system(size: 9))
                                .foregroundColor(Color(red: 0.94, green: 0.27, blue: 0.27))
                            Text("Mes favoris").font(.system(size: 9, weight: .bold))
                                .foregroundColor(.white.opacity(0.4)).textCase(.uppercase)
                        }
                        ForEach(Array(entry.data.favorites.prefix(2).enumerated()), id: \.offset) { i, s in
                            HStack(spacing: 8) {
                                Image(systemName: "heart.fill").font(.system(size: 11))
                                    .foregroundColor(Color(red: 0.94, green: 0.27, blue: 0.27))
                                Text(s.name).font(.system(size: 11, weight: .semibold)).foregroundColor(.white).lineLimit(1)
                                Spacer()
                                Text("\(s.distance) km").font(.system(size: 10)).foregroundColor(.white.opacity(0.4))
                                Text("CHF \(s.price)").font(.system(size: 12, weight: .bold)).monospacedDigit()
                                    .foregroundColor(Color(red: 0.94, green: 0.27, blue: 0.27).opacity(0.9))
                            }
                            .padding(.horizontal, 8).padding(.vertical, 5)
                            .background(Color(red: 0.94, green: 0.27, blue: 0.27).opacity(0.06)).cornerRadius(9)
                            .overlay(RoundedRectangle(cornerRadius: 9).stroke(Color(red: 0.94, green: 0.27, blue: 0.27).opacity(0.15), lineWidth: 1))
                        }
                    }
                }
                // Meilleures stations
                VStack(spacing: 4) {
                    ForEach(Array(entry.data.stations.prefix(entry.data.favorites.isEmpty ? 4 : 2).enumerated()), id: \.offset) { i, s in
                        HStack(spacing: 8) {
                            ZStack {
                                Circle().fill(i == 0 ? Color.otGreen : i == 1 ? Color.otTeal.opacity(0.8) : Color.otPurple.opacity(0.5))
                                    .frame(width: 22, height: 22)
                                Text("\(i + 1)").font(.system(size: 10, weight: .bold)).foregroundColor(.white)
                            }
                            Text(s.name).font(.system(size: 11, weight: .semibold)).foregroundColor(.white).lineLimit(1)
                            Spacer()
                            Text("\(s.distance) km").font(.system(size: 10)).foregroundColor(.white.opacity(0.4))
                            Text("CHF \(s.price)").font(.system(size: 12, weight: .bold)).monospacedDigit()
                                .foregroundColor(i == 0 ? Color.otGreen : .white.opacity(0.8))
                        }
                        .padding(.horizontal, 8).padding(.vertical, 5)
                        .background(i == 0 ? Color.otGreen.opacity(0.08) : Color.white.opacity(0.02)).cornerRadius(9)
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(i == 0 ? Color.otGreen.opacity(0.2) : Color.otBorder, lineWidth: 1))
                    }
                }
            }
            .padding(14)
        }
        .widgetBg(Color.otBg)
        .widgetURL(URL(string: "optitank://radar"))
    }
}

// MARK: - Lock Screen
struct LockScreenInlineView: View {
    let entry: WidgetEntry
    var body: some View {
        Label {
            Text("\(entry.data.fuelType) CHF \(entry.data.bestPrice) · \(entry.data.stationName)")
                .font(.system(size: 12, weight: .semibold)).lineLimit(1)
        } icon: {
            Image(systemName: "fuelpump.fill")
        }
    }
}

struct LockScreenRectView: View {
    let entry: WidgetEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("OptiTank · \(entry.data.fuelType)").font(.system(size: 9, weight: .bold)).opacity(0.6)
            Text("CHF \(entry.data.bestPrice) · \(entry.data.stationName)")
                .font(.system(size: 12, weight: .bold)).lineLimit(1)
        }
    }
}

// MARK: - Entry View (dispatches by family)
struct OptiTankWidgetEntryView: View {
    let entry: WidgetEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemMedium:         MediumWidgetView(entry: entry)
        case .systemLarge:          LargeWidgetView(entry: entry)
        case .accessoryInline:      LockScreenInlineView(entry: entry)
        case .accessoryRectangular: LockScreenRectView(entry: entry)
        default:                    SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Widget
struct OptiTankWidget: Widget {
    let kind = "OptiTankWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WidgetDataProvider()) { entry in
            OptiTankWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("OptiTank")
        .description("Prix carburant — Meilleure offre en temps réel 🇨🇭")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .systemLarge,
            .accessoryInline,
            .accessoryRectangular,
        ])
    }
}

// MARK: - Favorites Widget Views

struct FavSmallView: View {
    let entry: WidgetEntry
    var body: some View {
        // Station sélectionnée dans le profil en priorité, sinon premier favori
        let fav = entry.data.selectedStation ?? entry.data.favorites.first
        ZStack(alignment: .bottom) {
            Circle().fill(Color(red: 0.94, green: 0.27, blue: 0.27).opacity(0.12)).frame(width: 90).offset(x: 40, y: -40)
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(entry.data.fuelType)
                        .font(.system(size: 10, weight: .bold)).foregroundColor(.white.opacity(0.45))
                        .textCase(.uppercase).kerning(0.5)
                    Spacer()
                    Image(systemName: "heart.fill")
                        .foregroundColor(Color(red: 0.94, green: 0.27, blue: 0.27)).font(.system(size: 13))
                }
                Spacer()
                if let f = fav {
                    Text(f.price)
                        .font(.system(size: 44, weight: .black, design: .rounded))
                        .foregroundColor(.white).lineLimit(1).minimumScaleFactor(0.65)
                    Text("CHF / litre")
                        .font(.system(size: 10, weight: .semibold)).foregroundColor(.white.opacity(0.4))
                    Spacer()
                    Divider().background(Color.otBorder)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(f.name).font(.system(size: 10, weight: .bold)).foregroundColor(.white.opacity(0.75)).lineLimit(1)
                        Text("\(f.distance) km").font(.system(size: 10, weight: .bold)).foregroundColor(Color(red: 0.94, green: 0.27, blue: 0.27))
                    }
                } else {
                    Text("Aucun favori").font(.system(size: 14, weight: .semibold)).foregroundColor(.white.opacity(0.5))
                    Text("Appuyez ❤️ sur une station").font(.system(size: 10)).foregroundColor(.white.opacity(0.3)).lineLimit(2)
                }
            }
            .padding(14)
        }
        .widgetBg(Color.otBg)
        .widgetURL({
            if let id = fav?.id, !id.isEmpty {
                return URL(string: "optitank://station?id=\(id)")
            }
            return URL(string: "optitank://radar")
        }())
    }
}

struct FavMediumView: View {
    let entry: WidgetEntry
    var body: some View {
        ZStack {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    Image(systemName: "heart.fill").foregroundColor(Color(red: 0.94, green: 0.27, blue: 0.27)).font(.system(size: 12))
                    Text("Mes stations favorites · \(entry.data.fuelType)")
                        .font(.system(size: 10, weight: .bold)).foregroundColor(.white.opacity(0.45)).textCase(.uppercase).kerning(0.4)
                    Spacer()
                }
                .padding(.bottom, 10)
                if entry.data.favorites.isEmpty {
                    Spacer()
                    HStack { Spacer()
                        VStack(spacing: 6) {
                            Image(systemName: "heart.slash").font(.system(size: 24)).foregroundColor(.white.opacity(0.2))
                            Text("Aucun favori").font(.system(size: 13, weight: .semibold)).foregroundColor(.white.opacity(0.4))
                            Text("Appuyez ❤️ sur une station dans l'app").font(.system(size: 10)).foregroundColor(.white.opacity(0.25)).multilineTextAlignment(.center)
                        }
                        Spacer()
                    }
                    Spacer()
                } else {
                    ForEach(Array(entry.data.favorites.prefix(3).enumerated()), id: \.offset) { i, s in
                        HStack(spacing: 8) {
                            Image(systemName: "heart.fill").font(.system(size: 11))
                                .foregroundColor(Color(red: 0.94, green: 0.27, blue: 0.27))
                            Text(s.name).font(.system(size: 11, weight: .semibold)).foregroundColor(.white).lineLimit(1)
                            Spacer()
                            Text("\(s.distance) km").font(.system(size: 10)).foregroundColor(.white.opacity(0.4))
                            Text("CHF \(s.price)").font(.system(size: 13, weight: .bold)).monospacedDigit().foregroundColor(.white)
                        }
                        .padding(.horizontal, 8).padding(.vertical, 6)
                        .background(Color.white.opacity(0.04)).cornerRadius(9)
                        .overlay(RoundedRectangle(cornerRadius: 9).stroke(Color(red: 0.94, green: 0.27, blue: 0.27).opacity(0.2), lineWidth: 1))
                        .padding(.bottom, 4)
                    }
                }
                Spacer()
            }
            .padding(14)
        }
        .widgetBg(Color.otBg)
        .widgetURL(URL(string: "optitank://radar"))
    }
}

struct FavWidgetEntryView: View {
    let entry: WidgetEntry
    @Environment(\.widgetFamily) var family
    var body: some View {
        switch family {
        case .systemMedium: FavMediumView(entry: entry)
        default:            FavSmallView(entry: entry)
        }
    }
}

struct OptiTankFavoritesWidget: Widget {
    let kind = "OptiTankFavoritesWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WidgetDataProvider()) { entry in
            FavWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("OptiTank — Favoris")
        .description("Prix de vos stations favorites ❤️")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Preview
struct OptiTankWidget_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            OptiTankWidgetEntryView(entry: WidgetEntry(date: .now, data: .placeholder))
                .previewContext(WidgetPreviewContext(family: .systemSmall))
            OptiTankWidgetEntryView(entry: WidgetEntry(date: .now, data: .placeholder))
                .previewContext(WidgetPreviewContext(family: .systemMedium))
            OptiTankWidgetEntryView(entry: WidgetEntry(date: .now, data: .placeholder))
                .previewContext(WidgetPreviewContext(family: .systemLarge))
        }
    }
}
