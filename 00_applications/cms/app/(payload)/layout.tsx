import { RootLayout, handleServerFunctions } from "@payloadcms/next/layouts";
import React from "react";
import config from "../../payload.config";
import { importMap } from "./admin/importMap";
import "./custom.css";

type Args = {
  children: React.ReactNode;
};

const Layout = ({ children }: Args) => (
  <RootLayout
    config={config}
    importMap={importMap}
    serverFunction={async (args) => {
      "use server";
      return handleServerFunctions({ config, importMap, ...args });
    }}
  >
    {children}
  </RootLayout>
);

export default Layout;
