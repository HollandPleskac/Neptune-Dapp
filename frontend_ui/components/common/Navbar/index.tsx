import WhiteLogo from './../../../assets/WhiteLogo'
const Navbar = () => {
  return (
    <nav className="flex justify-between text-white items-center mt-6 mb-14">
      <WhiteLogo />
      <ul className='flex justify-between'>
        <li className='mr-6'>Dashboard</li>
        <li className='mr-6'>Lend</li>
        <li className='mr-6'>Stake</li>
        <li>Governance</li>
      </ul>
      <p>Wallet</p>
    </nav>
  )
}

export default Navbar