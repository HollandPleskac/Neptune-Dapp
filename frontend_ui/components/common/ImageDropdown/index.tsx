import { useState } from 'react';
import useDropdownMenu from 'react-accessible-dropdown-menu-hook';

import SolLogo from 'assets/SolLogo';
import CaretUp from 'assets/CaretUp';
import CaretDown from 'assets/CaretDown';
import NeptuneLogo from 'assets/NeptuneLogo';
import styles from './image-dropdown.module.scss';

const ImageDropdown = () => {
  const options = [
    {
      text: 'sol',
      icon: <SolLogo />,
    },
    {
      text: 'nep',
      icon: <NeptuneLogo />,
    },
  ];
  const [option, setOption] = useState(options[0]);
  const { buttonProps, itemProps, isOpen, setIsOpen } = useDropdownMenu(2);

  const handleClick = (opt: OptionProps) => {
    setOption(opt);
    setIsOpen(false);
  };
  return (
    <div className='relative'>
      <button {...buttonProps} type='button' className={styles['demo-button']}>
        <span className={styles['button-img']}>{option.icon}</span>
        {isOpen ? <CaretUp /> : <CaretDown />}
      </button>

      <div
        className={`${styles['demo-menu']} ${isOpen ? 'visible' : ''}`}
        role='menu'
      >
        {options.map((opt, i) => (
          <span
            key={i}
            {...itemProps[i]}
            id='menu-item-1'
            onClick={() => handleClick(opt)}
          >
            <span>
              {opt.icon} {opt.text}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

type OptionProps = {
  text: string;
  icon: JSX.Element;
};

export default ImageDropdown;
