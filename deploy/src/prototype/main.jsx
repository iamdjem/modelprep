import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import './tokens.css';
import PrototypeApp from './app.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrototypeApp />
  </React.StrictMode>,
);
