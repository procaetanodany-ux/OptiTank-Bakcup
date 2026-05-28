import WidgetKit
import SwiftUI

let APP_GROUP  = "group.online.optitank.app"
let WIDGET_KEY = "widget_best_price"

struct WidgetStation: Codable {
    let name: String
    let price: String
    let distance: String
    let id: String?
}

struct WidgetData: Codable {
    let bestPrice: String
    let stationName: String
    let distance: String
    let fuelType: String
    let stations: [WidgetStation]
    let favorites: [WidgetStation]
    let selectedStation: WidgetStation?
    let priceHistory: [Double]
    let updatedAt: String

    // Station à afficher en priorité : sélection manuelle > sinon meilleur prix 25km
    var displayStation: WidgetStation {
        selectedStation ?? WidgetStation(name: stationName, price: bestPrice, distance: distance, id: nil)
    }

    static let placeholder = WidgetData(
        bestPrice: "1.720",
        stationName: "Avia Cheseaux",
        distance: "2.3",
        fuelType: "SP95",
        stations: [
            WidgetStation(name: "Avia Cheseaux",    price: "1.720", distance: "2.3", id: nil),
            WidgetStation(name: "BP Lausanne-Nord", price: "1.759", distance: "3.1", id: nil),
            WidgetStation(name: "Shell Crissier",   price: "1.880", distance: "4.7", id: nil),
            WidgetStation(name: "Total Écluse",     price: "1.970", distance: "5.2", id: nil),
        ],
        favorites: [
            WidgetStation(name: "Shell Crissier", price: "1.880", distance: "4.7", id: nil),
        ],
        selectedStation: nil,
        priceHistory: [1.95, 1.98, 1.84, 1.78, 1.75, 1.72, 1.720],
        updatedAt: ISO8601DateFormatter().string(from: .now)
    )
}

struct WidgetEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct WidgetDataProvider: TimelineProvider {
    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(date: .now, data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        completion(WidgetEntry(date: .now, data: loadData() ?? .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        let data = loadData() ?? .placeholder
        let entry = WidgetEntry(date: .now, data: data)
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: .now) ?? .now
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func loadData() -> WidgetData? {
        guard let defaults = UserDefaults(suiteName: APP_GROUP),
              let json = defaults.string(forKey: WIDGET_KEY),
              let raw  = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetData.self, from: raw)
    }
}
