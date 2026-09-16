import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Navbar({ activeTab, setActiveTab, isScraping, onTriggerScrape, healthData }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        mobileOpen={mobileOpen} 
        setMobileOpen={setMobileOpen} 
      />
      <Header 
        onTriggerScrape={onTriggerScrape} 
        isScraping={isScraping} 
        healthData={healthData} 
        setMobileOpen={setMobileOpen} 
      />
    </>
  );
}
