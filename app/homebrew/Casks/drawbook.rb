cask "drawbook" do
  version "1.0.0"

  on_arm do
    sha256 "REPLACE_WITH_ARM64_SHA256"
    url "https://github.com/YOUR_GITHUB_USERNAME/drawbook/releases/download/v#{version}/Drawbook-#{version}-arm64.dmg"
  end

  name "Drawbook"
  desc "A productivity app for drawing, notes, and documents"
  homepage "https://github.com/YOUR_GITHUB_USERNAME/drawbook"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Drawbook.app"

  zap trash: [
    "~/Library/Application Support/drawbook",
    "~/Library/Preferences/com.drawbook.app.plist",
  ]
end
