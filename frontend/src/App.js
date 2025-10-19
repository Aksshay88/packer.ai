import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SavedConfigs from "./pages/SavedConfigs";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/saved" element={<SavedConfigs />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;