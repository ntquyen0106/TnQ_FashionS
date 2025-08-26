import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import Products from "./pages/Products"; // hoặc placeholder
import Login from "./pages/Login";
import Register from "./pages/Register";

function Navbar() {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const logout = () => {
    localStorage.removeItem("user");
    nav("/login");
  };

  return (
    <nav className="nav">
      <div className="container" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div className="brand">
          <Link to="/">TnQ Fashion</Link>
        </div>
        <div className="nav-links" style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <Link to="/">Trang chủ</Link>
          <Link to="/products">Sản phẩm</Link>
          {user ? (
            <>
              <span>Xin chào, {user.name}</span>
              <button onClick={logout} className="btn">Đăng xuất</button>
            </>
          ) : (
            <Link to="/login">Đăng nhập</Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}
