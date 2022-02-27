import cx from 'classnames';
import More from 'assets/More';
import WhiteLogo from 'assets/WhiteLogo';

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
      name: 'Market',
      link: '/',
    },
    {
      name: 'Fixed',
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
    {
      name: '...',
      link: '/',
      icon: <More />,
    },
  ];
  return (
    <nav className='flex justify-between text-white items-center mt-6 mb-14'>
      <WhiteLogo />
      <ul className='flex justify-between'>
        {links.map((link, i) => (
          <li key={i} className={cx('mr-6 font-bold')}>
            {link.name}
            {link.icon && link.icon}
          </li>
        ))}
      </ul>
      <p>Wallet</p>
    </nav>
  );
};

export default Navbar;
