#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"LifeOS";
  self.initialProps = @{};
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  // Round 41: pin Metro host to Mac's Tailscale IP so a sideloaded Debug
  // build over Wi-Fi/cellular can fetch the JS bundle + receive HMR pushes.
  // RCTBundleURLProvider's auto-discovery only works for USB-tethered or
  // same-LAN devices — Tailscale traffic goes through the tailnet so we set
  // jsLocation explicitly.
  [[RCTBundleURLProvider sharedSettings] setJsLocation:@"100.100.210.85"];
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
