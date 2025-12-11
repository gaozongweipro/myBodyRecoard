

import React from 'react';

import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, FileText, PlusCircle, User, BarChart2, Pill } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Home size={24} />
        <span>首页</span>
      </NavLink>
      <NavLink to="/records" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <FileText size={24} />
        <span>记录</span>
      </NavLink>


      <NavLink to="/add" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <PlusCircle size={24} />
        <span>录入</span>
      </NavLink>
      <NavLink to="/medications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Pill size={24} />
        <span>用药</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <User size={24} />
        <span>我的</span>
      </NavLink>
    </nav>
  );
};


const Layout = () => {
  const location = useLocation();

  return (
    <div style={{ 
        height: '100vh', 
        width: '100vw',
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden', 
        background: 'var(--background)' 
    }}>
      {/* Scrollable Content Area */}
      <div 
        id="scroll-container"
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          WebkitOverflowScrolling: 'touch',
          paddingTop: 'max(24px, var(--safe-top))', // Moved from body
          paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom) + 20px)', // Space for fixed nav
          width: '100%',
          position: 'relative' // Needed for absolute positioning of pages if we wanted overlap, but simple fade/slide is fine
      }}>

        <AnimatePresence mode="wait">
            <motion.div
                key={location.pathname}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                style={{ 
                    minHeight: '100%',
                    paddingBottom: '20px' // Add extra inner padding
                }} 
            >
                <Outlet />
            </motion.div>
        </AnimatePresence>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Layout;
