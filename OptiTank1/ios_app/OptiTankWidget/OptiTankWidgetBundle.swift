import WidgetKit
import SwiftUI

@main
struct OptiTankWidgetBundle: WidgetBundle {
    var body: some Widget {
        OptiTankWidget()
        OptiTankFavoritesWidget()
    }
}
