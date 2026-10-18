import Foundation

// Shared by the app module and DeviceActivity extension. No application tokens
// or user data are serialized in this schedule model.
enum FreedAppGuardMode: String {
  case beforeUse = "before-use"
  case dailyLimit = "daily-limit"
  case scheduled = "scheduled"
}

struct FreedAppGuardSchedule: Codable, Equatable {
  let id: String
  let enabled: Bool
  let startMinute: Int
  let endMinute: Int
  let days: [Int]
  let packages: [String]
  let allDay: Bool?
}

struct FreedAppGuardScheduleConfiguration: Codable, Equatable {
  let version: Int
  let targetScope: String
  let schedules: [FreedAppGuardSchedule]
  let strictGuard: Bool?

  init(version: Int, targetScope: String, schedules: [FreedAppGuardSchedule], strictGuard: Bool? = nil) {
    self.version = version; self.targetScope = targetScope; self.schedules = schedules; self.strictGuard = strictGuard
  }
}

struct FreedAppGuardRegistration: Equatable {
  let name: String
  let intervalStart: DateComponents
  let intervalEnd: DateComponents
}

enum FreedAppGuardSchedulePolicy {
  static let configurationKey = "freed.appGuard.schedules.v1"
  static let activityPrefix = "freed.appGuard.schedule."
  static let maximumActivities = 20
  static let empty = FreedAppGuardScheduleConfiguration(version: 1, targetScope: "selected-applications", schedules: [])

  static func decode(_ data: Data?) -> FreedAppGuardScheduleConfiguration? {
    guard let data, data.count <= 65_536,
      let raw = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      Set(raw.keys).isSubset(of: ["version", "targetScope", "schedules", "strictGuard"]),
      !(raw["strictGuard"] is NSNull),
      let items = raw["schedules"] as? [[String: Any]], items.allSatisfy({
        Set($0.keys).isSubset(of: ["id", "enabled", "startMinute", "endMinute", "days", "packages", "allDay"])
          && !($0["allDay"] is NSNull)
      }),
      let config = try? JSONDecoder().decode(FreedAppGuardScheduleConfiguration.self, from: data),
      config.version == 1, config.targetScope == "selected-applications", config.schedules.count <= 3 else { return nil }
    var seen = Set<String>()
    for schedule in config.schedules {
      guard ["sleep", "work", "weekend"].contains(schedule.id), seen.insert(schedule.id).inserted,
        (0..<1_440).contains(schedule.startMinute), (0..<1_440).contains(schedule.endMinute),
        schedule.packages.isEmpty, schedule.days.count <= 7,
        schedule.days.allSatisfy({ (0...6).contains($0) }),
        Set(schedule.days).count == schedule.days.count else { return nil }
      if schedule.allDay == true {
        guard schedule.id == "weekend", Set(schedule.days) == [0, 6] else { return nil }
      }
      if schedule.enabled {
        guard !schedule.days.isEmpty,
          schedule.allDay == true || schedule.startMinute != schedule.endMinute else { return nil }
        if schedule.id == "weekend" && schedule.allDay != true { return nil }
      }
    }
    return config
  }

  static func decode(_ input: [String: Any]) -> FreedAppGuardScheduleConfiguration? {
    guard JSONSerialization.isValidJSONObject(input),
      let data = try? JSONSerialization.data(withJSONObject: input) else { return nil }
    return decode(data)
  }

  static func registrations(_ config: FreedAppGuardScheduleConfiguration) -> [FreedAppGuardRegistration] {
    config.schedules.filter(\.enabled).flatMap { schedule -> [FreedAppGuardRegistration] in
      let days = schedule.days.sorted()
      // All-day rules remain weekly. An ordinary seven-day clock window can
      // use one repeating daily activity, reducing the system activity budget.
      if days == Array(0...6), schedule.allDay != true {
        return [FreedAppGuardRegistration(name: activityPrefix + schedule.id + ".daily",
          intervalStart: DateComponents(hour: schedule.startMinute / 60, minute: schedule.startMinute % 60),
          intervalEnd: DateComponents(hour: schedule.endMinute / 60, minute: schedule.endMinute % 60))]
      }
      return days.map { day in
        let start = schedule.allDay == true ? 0 : schedule.startMinute
        let end = schedule.allDay == true ? 0 : schedule.endMinute
        let nextDay = schedule.allDay == true || end < start ? (day + 1) % 7 : day
        return FreedAppGuardRegistration(name: activityPrefix + schedule.id + ".day\(day)",
          intervalStart: DateComponents(hour: start / 60, minute: start % 60, weekday: day + 1),
          intervalEnd: DateComponents(hour: end / 60, minute: end % 60, weekday: nextDay + 1))
      }
    }
  }

  static func activeIDs(_ config: FreedAppGuardScheduleConfiguration, at date: Date = Date(), calendar: Calendar = .current) -> [String] {
    let day = calendar.component(.weekday, from: date) - 1
    let minute = calendar.component(.hour, from: date) * 60 + calendar.component(.minute, from: date)
    return config.schedules.filter { schedule in
      guard schedule.enabled else { return false }
      if schedule.allDay == true { return schedule.days.contains(day) }
      if schedule.startMinute < schedule.endMinute {
        return schedule.days.contains(day) && minute >= schedule.startMinute && minute < schedule.endMinute
      }
      // The after-midnight part belongs to the previous local start day.
      return (schedule.days.contains(day) && minute >= schedule.startMinute)
        || (schedule.days.contains((day + 6) % 7) && minute < schedule.endMinute)
    }.map(\.id).sorted()
  }

  static func relockRegistration(expiresAt: Date, calendar: Calendar = .current) -> FreedAppGuardRegistration {
    let components: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second, .timeZone]
    return FreedAppGuardRegistration(name: "freed.earnedUnlockWindow",
      intervalStart: calendar.dateComponents(components, from: expiresAt),
      intervalEnd: calendar.dateComponents(components, from: expiresAt.addingTimeInterval(16 * 60)))
  }

  static func nextBoundary(_ config: FreedAppGuardScheduleConfiguration, after date: Date = Date(), calendar: Calendar = .current) -> Date? {
    var candidates = [Date]()
    let today = calendar.startOfDay(for: date)
    for offset in -1...7 {
      guard let startDay = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
      let day = calendar.component(.weekday, from: startDay) - 1
      for schedule in config.schedules where schedule.enabled && schedule.days.contains(day) {
        let start = schedule.allDay == true ? 0 : schedule.startMinute
        let end = schedule.allDay == true ? 0 : schedule.endMinute
        let nextDay = schedule.allDay == true || end < start
        guard let endDay = nextDay ? calendar.date(byAdding: .day, value: 1, to: startDay) : startDay,
          let startDate = calendar.date(bySettingHour: start / 60, minute: start % 60, second: 0, of: startDay),
          let endDate = calendar.date(bySettingHour: end / 60, minute: end % 60, second: 0, of: endDay) else { continue }
        if startDate > date { candidates.append(startDate) }
        if endDate > date { candidates.append(endDate) }
      }
    }
    return candidates.min()
  }
}
