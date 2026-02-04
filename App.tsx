import React from 'react';
import Navigation from './src/naviagtion/index'; // Ensure typo 'naviagtion' matches your folder name
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <>
      <Navigation />
      <StatusBar style="auto" />
    </>
  );
}