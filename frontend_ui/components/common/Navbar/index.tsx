import cx from 'classnames';
import { useWallet } from '@solana/wallet-adapter-react';

import More from 'assets/More';
import WhiteLogo from 'assets/WhiteLogo';

const Navbar = () => {
  const { publicKey, disconnect, wallet } = useWallet();
  // const { connection } = useConnection();
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
  // console.log(2, wallet);
  const pubKey = publicKey?.toString();
  const splitPubKey = `${pubKey?.substring(0, 4)} ... ${pubKey?.substring(
    pubKey?.length - 5,
    pubKey?.length - 1,
  )}`;
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
      <div>
        {publicKey ? (
          <div
            onClick={() => disconnect()}
            className='flex items-center cursor-pointer border border-blue-light rounded-lg py-4 px-6'
          >
            <img
              src={wallet?.adapter?.icon}
              alt='Wallet'
              className='mr-10px w-4 h-4'
            />
            {splitPubKey}
          </div>
        ) : (
          <span>Connect to Wallet</span>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
