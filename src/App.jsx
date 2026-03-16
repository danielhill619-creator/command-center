import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './shared/components/ProtectedRoute'
import Login from './pages/Login'
import MailWorkspace from './pages/MailWorkspace'
import Settings from './pages/Settings'
import HomeBase from './worlds/homebase/HomeBase'
import WorkWorld from './worlds/work/WorkWorld'
import SchoolWorld from './worlds/school/SchoolWorld'
import HomeWorld from './worlds/home/HomeWorld'
import FunWorld from './worlds/fun/FunWorld'
import SpiritualWorld from './worlds/spiritual/SpiritualWorld'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected worlds */}
        <Route path="/homebase" element={
          <ProtectedRoute><HomeBase /></ProtectedRoute>
        } />
        <Route path="/work" element={
          <ProtectedRoute><WorkWorld /></ProtectedRoute>
        } />
        <Route path="/school" element={
          <ProtectedRoute><SchoolWorld /></ProtectedRoute>
        } />
        <Route path="/home" element={
          <ProtectedRoute><HomeWorld /></ProtectedRoute>
        } />
        <Route path="/fun" element={
          <ProtectedRoute><FunWorld /></ProtectedRoute>
        } />
        <Route path="/spiritual" element={
          <ProtectedRoute><SpiritualWorld /></ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute><Settings /></ProtectedRoute>
        } />
        <Route path="/mail" element={
          <ProtectedRoute><MailWorkspace /></ProtectedRoute>
        } />

        {/* Catch-all → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
