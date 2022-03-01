import cx from 'classnames';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletModalButton } from '@solana/wallet-adapter-react-ui';

import More from 'assets/More';
import WhiteLogo from 'assets/WhiteLogo';

import WalletDropdown from 'components/WalletDropdown';

import styles from './navbar.module.scss';

const Navbar = () => {
  const { publicKey, disconnect, wallet } = useWallet();
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
      link: '/',
      icon: <More />,
      classNames: 'flex items-center',
    },
  ];
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
          <li
            key={i}
            className={cx('mr-6 font-bold cursor-pointer', link.classNames)}
          >
            {link.name}
            {link.icon && link.icon}
          </li>
        ))}
      </ul>
      <div>
        {publicKey ? (
          <WalletDropdown
            walletIcon={wallet?.adapter?.icon}
            pubKey={splitPubKey}
            disconnect={disconnect}
          />
        ) : (
          <WalletModalButton
            className={styles['neptune-navbar__connect-wallet']}
          >
            Connect to Wallet
          </WalletModalButton>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
