import React from "react";
import { AppContextProvider } from './App.context';
import ResourceWrapper from "./components/ResourceWrapper";

export default function App(props) {
  return (
    <AppContextProvider >
      <ResourceWrapper />
    </AppContextProvider >
  );
}
