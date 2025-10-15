import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function MainLayout() {
  const loc = useLocation();
  const path = loc.pathname || '';
  // Hide mega menu on order detail pages for a cleaner view
  const hideMenu = path.startsWith('/orders/');
  const hideActions = hideMenu; // also hide search & cart on order detail
  return (
    <>
      <Navbar hideMenu={hideMenu} showSearch={!hideActions} showCart={!hideActions} />
      <Outlet />
      <Footer />
    </>
  );
}
