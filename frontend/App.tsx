import React from "react";
import { AuthProvider } from "./contexts/AuthProvider";
import { ThemeProvider } from "./contexts/ThemeProvider";
import { AppNavigator } from "./navigation/AppNavigator";

const App = () => (
  <AuthProvider>
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  </AuthProvider>
);

export default App;

