import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

console.log('main.tsx: Starting React app...');

const rootElement = document.getElementById("root");
console.log('main.tsx: Root element found:', rootElement);

if (!rootElement) {
  console.error('main.tsx: Root element not found!');
} else {
  console.log('main.tsx: Creating React root...');
  const root = ReactDOM.createRoot(rootElement);
  
  console.log('main.tsx: Rendering App component...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  console.log('main.tsx: App rendered successfully!');
}
