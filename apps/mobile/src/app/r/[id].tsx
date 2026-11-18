import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { ActivityIndicator } from "react-native";
import { requestLink } from "@/lib/config";

// A request link opened in the app (pomi://r/<id>, or the web link once
// universal links are set up) pays through the web pay page, shown in the
// in-app browser: the checkout is web-only in this version.
export default function OpenRequestLink() {
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    void WebBrowser.openBrowserAsync(requestLink(id)).then(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }
    });
  }, [id]);

  return <ActivityIndicator style={{ flex: 1 }} />;
}
