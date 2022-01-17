import WhiteLogo from './../../../assets/WhiteLogo'
const Navbar = () => {
  return (
    <nav className="flex justify-between text-white">
      <WhiteLogo />
      <ul>
        <li>Dashboard</li>
        <li>Lend</li>
        <li>Vault</li>
        <li>Farm</li>
        <li>Governance</li>
      </ul>
      <p>Wallet</p>
    </nav>
  )
}

export default Navbar