import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { I18nProvider } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import InstallAppBanner from "@/components/InstallAppBanner";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/">
      <I18nProvider>
        <TooltipProvider>
          <App />
          <Toaster />
          <InstallAppBanner />
        </TooltipProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
