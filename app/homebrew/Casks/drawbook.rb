cask "drawbook" do
  version "1.0.0"

  on_arm do
    sha256 "75c0d3bcb3929e0470b371ba9924209556d6ec091add79fa955af55ed9cd86a6"
    url "https://github.com/sidharthmsk/drawBookRelease/releases/download/v#{version}/Drawbook-#{version}-arm64.dmg"
  end

  on_intel do
    sha256 "e6a1065c90a6c435388f71916effa3d5f04aa748cbac64987d7536b4e35f13c8"
    url "https://github.com/sidharthmsk/drawBookRelease/releases/download/v#{version}/Drawbook-#{version}.dmg"
  end

  name "Drawbook"
  desc "A productivity app for drawing, notes, and documents"
  homepage "https://github.com/sidharthmsk/drawBookRelease"

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
