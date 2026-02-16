import React from 'react';
import { Platform } from 'react-native';
import Navigation from './src/naviagtion/index'; // Ensure typo 'naviagtion' matches your folder name
import { StatusBar } from 'expo-status-bar';

// Inject scrollbar styles for PC users
if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    ::-webkit-scrollbar-thumb {
      background-color: #d4af37; /* Match your gold theme */
      border-radius: 10px;
      border: 2px solid #ffffff;
    }
    ::-webkit-scrollbar-track {
      background: #f1f1f1;
    }
    /* Fix for horizontal scrolling on tables */
    .custom-horizontal-scroll {
      overflow-x: auto !important;
    }
  `;
  document.head.append(style);
}

export default function App() {
  return (
    <>
      <Navigation />
      <StatusBar style="auto" />
    </>
  );
}