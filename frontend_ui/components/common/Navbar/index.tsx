import WhiteLogo from './../../../assets/WhiteLogo';

const Navbar = () => {
  const links = [
    {
      name: 'Dashboard',
      link: '/',
    },
    {
      name: 'Lend',
      link: '/',
    },
    {
      name: 'Stake',
      link: '/',
    },
    {
      name: 'Governance',
      link: '/',
    },
  ];
  return (
    <nav className='flex justify-between text-white items-center mt-6 mb-14'>
      <WhiteLogo />
      <ul className='flex justify-between'>
        {links.map((link, i) => (
          <li key={i} className='mr-6 font-bold'>
            {link.name}
          </li>
        ))}
      </ul>
      <p>Wallet</p>
    </nav>
  );
};

export default Navbar;
