import useDropdownMenu from 'react-accessible-dropdown-menu-hook';

import CaretUp from 'assets/CaretUp';
import CopyIcon from 'assets/CopyIcon';
import CaretDown from 'assets/CaretDown';
import NetworkIcon from 'assets/NetworkIcon';
import DisconnectIcon from 'assets/DisconnectIcon';
import styles from './wallet-dropdown.module.scss';

const WalletDropdown = ({ walletIcon, pubKey, disconnect }: Props) => {
  const options = [
    {
      text: 'Change Network',
      icon: <NetworkIcon />,
    },
    {
      text: 'Copy Address',
      icon: <CopyIcon />,
    },
    {
      text: 'Disconnect',
      icon: <DisconnectIcon />,
      clickHandler: disconnect,
    },
  ];
  const { buttonProps, itemProps, isOpen } = useDropdownMenu(2);

  return (
    <div className='relative flex justify-end'>
      <button {...buttonProps} type='button'>
        <div className='flex items-center cursor-pointer border border-blue-light rounded-lg py-4 px-6'>
          <img src={walletIcon} alt='Wallet' className='mr-10px w-4 h-4' />
          <span className='mr-14px'>{pubKey}</span>
          {isOpen ? <CaretUp /> : <CaretDown />}
        </div>
      </button>

      <div
        className={`${styles['demo-menu']} ${isOpen ? 'visible' : ''}`}
        role='menu'
      >
        <div className='font-bold text-base m-0 p-6 border-gray-fadedMost border-l-0 border-t-0 border-r-0 border-b'>
          Wallet Settings
        </div>
        {options.map((opt, i) => (
          <span
            key={i}
            {...itemProps[i]}
            id='menu-item-1'
            onClick={() => opt.clickHandler && opt.clickHandler()}
          >
            <span className='flex hover:bg-gray-700 p-6 text-white text-base font-medium'>
              <span className='w-6 h-6 mr-18px'>{opt.icon}</span>
              <span>{opt.text}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

type Props = {
  disconnect: () => Promise<void>;
  walletIcon: string;
  pubKey: string;
};

export default WalletDropdown;
