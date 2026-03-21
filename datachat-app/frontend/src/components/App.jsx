// App.js
import { useState } from "react";
import { DarkModeContext } from "./DarkModeContext";
import { SettingsModal } from "./SettingsModal";
import { ChatArea } from "./ChatArea";

function App() {
    const [darkMode, setDarkMode] = useState(false);

    return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      <SettingsModal />
      <ChatArea />
    </DarkModeContext.Provider>
  );
}

export default App;