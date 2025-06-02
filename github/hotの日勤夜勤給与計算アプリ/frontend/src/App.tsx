import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import DayShiftPage from './pages/DayShiftPage';
import NightShiftPage from './pages/NightShiftPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/day-shift" element={<DayShiftPage />} />
            <Route path="/night-shift" element={<NightShiftPage />} />
          </Routes>
        </main>
        <footer className="bg-gray-800 text-white py-4 text-center text-sm">
          <div className="container mx-auto">
            <p>© 2025 勤務管理システム. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;