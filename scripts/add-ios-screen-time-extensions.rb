#!/usr/bin/env ruby
# frozen_string_literal: true

require "xcodeproj"

PROJECT_PATH = "ios/FREED.xcodeproj"
APP_TARGET = "FREED"
APP_GROUP = "group.app.freed.recovery"
APP_ENTITLEMENTS_PATH = "ios/FREED/FREED.entitlements"

EXTENSIONS = [
  {
    name: "FREEDShieldConfiguration",
    bundle_id: "app.freed.recovery.shield-configuration",
    source_dir: "FREEDShieldConfiguration",
    swift_file: "ShieldConfigurationExtension.swift",
    entitlements: "FREEDShieldConfiguration.entitlements",
    frameworks: ["ManagedSettings", "ManagedSettingsUI"],
    resources: [],
    family_controls: true
  },
  {
    name: "FREEDShieldAction",
    bundle_id: "app.freed.recovery.shield-action",
    source_dir: "FREEDShieldAction",
    swift_file: "ShieldActionExtension.swift",
    entitlements: "FREEDShieldAction.entitlements",
    frameworks: ["ManagedSettings"],
    resources: [],
    family_controls: true
  },
  {
    name: "FREEDDeviceActivityMonitor",
    bundle_id: "app.freed.recovery.device-activity-monitor",
    source_dir: "FREEDDeviceActivityMonitor",
    swift_file: "DeviceActivityMonitorExtension.swift",
    entitlements: "FREEDDeviceActivityMonitor.entitlements",
    frameworks: ["DeviceActivity", "ManagedSettings", "FamilyControls"],
    resources: [],
    family_controls: true
  },
  {
    name: "FREEDSafariContentBlocker",
    bundle_id: "app.freed.recovery.safari-content-blocker",
    source_dir: "FREEDSafariContentBlocker",
    swift_file: "ContentBlockerRequestHandler.swift",
    entitlements: "FREEDSafariContentBlocker.entitlements",
    frameworks: [],
    resources: ["blockerList.json"],
    family_controls: false
  }
].freeze

def ensure_extension_entitlements(path, family_controls:)
  entitlements = File.exist?(path) ? Xcodeproj::Plist.read_from_path(path) : {}
  if family_controls
    entitlements["com.apple.developer.family-controls"] = true
  else
    entitlements.delete("com.apple.developer.family-controls")
  end
  app_groups = Array(entitlements["com.apple.security.application-groups"])
  app_groups << APP_GROUP unless app_groups.include?(APP_GROUP)
  entitlements["com.apple.security.application-groups"] = app_groups
  Xcodeproj::Plist.write_to_path(entitlements, path)
end

project = Xcodeproj::Project.open(PROJECT_PATH)
app_target = project.targets.find { |target| target.name == APP_TARGET }
abort "Missing #{APP_TARGET} target" unless app_target

ensure_extension_entitlements(APP_ENTITLEMENTS_PATH, family_controls: true)

products_group = project.products_group

embed_phase =
  app_target.copy_files_build_phases.find { |phase| phase.display_name == "Embed App Extensions" } ||
  app_target.new_copy_files_build_phase("Embed App Extensions")
embed_phase.symbol_dst_subfolder_spec = :plug_ins

EXTENSIONS.each do |extension|
  target = project.targets.find { |candidate| candidate.name == extension[:name] }

  unless target
    target = project.new_target(:app_extension, extension[:name], :ios, "15.1")
    products_group << target.product_reference unless products_group.children.include?(target.product_reference)
  end

  target.build_configurations.each do |configuration|
    settings = configuration.build_settings
    settings["APPLICATION_EXTENSION_API_ONLY"] = "YES"
    settings["CLANG_ENABLE_MODULES"] = "YES"
    settings["CODE_SIGN_ENTITLEMENTS"] = "#{extension[:source_dir]}/#{extension[:entitlements]}"
    settings["CURRENT_PROJECT_VERSION"] = "1"
    settings["DEVELOPMENT_TEAM"] = "$(DEVELOPMENT_TEAM)"
    settings["GENERATE_INFOPLIST_FILE"] = "NO"
    settings["INFOPLIST_FILE"] = "#{extension[:source_dir]}/Info.plist"
    settings["IPHONEOS_DEPLOYMENT_TARGET"] = "15.1"
    settings["MARKETING_VERSION"] = "1.0.0"
    settings["PRODUCT_BUNDLE_IDENTIFIER"] = extension[:bundle_id]
    settings["PRODUCT_NAME"] = "$(TARGET_NAME)"
    settings["SKIP_INSTALL"] = "YES"
    settings["SWIFT_VERSION"] = "5.0"
    settings["TARGETED_DEVICE_FAMILY"] = "1,2"
  end

  group = project.main_group.children.find { |child| child.display_name == extension[:source_dir] }
  group ||= project.main_group.new_group(extension[:source_dir], extension[:source_dir])

  ([extension[:swift_file], "Info.plist", extension[:entitlements]] + Array(extension[:resources])).each do |file_name|
    group.files.find { |file| file.path == file_name } || group.new_file(file_name)
  end

  ensure_extension_entitlements(
    "ios/#{extension[:source_dir]}/#{extension[:entitlements]}",
    family_controls: extension.fetch(:family_controls, true)
  )

  swift_ref = group.files.find { |file| file.path == extension[:swift_file] }
  target.add_file_references([swift_ref]) if target.source_build_phase.files_references.none? { |ref| ref.path == swift_ref.path }

  Array(extension[:resources]).each do |file_name|
    file_ref = group.files.find { |file| file.path == file_name }
    next unless file_ref

    target.resources_build_phase.add_file_reference(file_ref) unless target.resources_build_phase.files_references.any? { |ref| ref.path == file_ref.path }
  end

  extension[:frameworks].each do |framework|
    target.add_system_framework(framework)
  end

  app_target.add_dependency(target) unless app_target.dependencies.any? { |dependency| dependency.target == target }
  embed_phase.add_file_reference(target.product_reference) unless embed_phase.files_references.include?(target.product_reference)
end

project.save
