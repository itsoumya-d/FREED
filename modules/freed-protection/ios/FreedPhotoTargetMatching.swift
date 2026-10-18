import Foundation

enum FreedPhotoTargetMatching {
  static func matches(observed: String, expected: String) -> Bool {
    func normalize(_ value: String) -> String {
      value.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted)
        .filter { !$0.isEmpty }.joined(separator: " ")
    }
    let actual = normalize(observed), target = normalize(expected)
    return !actual.isEmpty && !target.isEmpty && actual == target
  }
}
