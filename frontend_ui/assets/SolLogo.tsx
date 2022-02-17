type Props = {
  [key: string]: any;
};
const SvgComponent = (props: Props) => (
  <svg
    width='64'
    height='64'
    viewBox='0 0 64 64'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    {...props}
  >
    <rect width='64' height='64' rx='32' fill='black' />
    <g clipPath='url(#clip0_277_990)'>
      <path
        d='M19.1725 41.7132C19.4018 41.4437 19.7171 41.2865 20.0515 41.2865H50.3789C50.9331 41.2865 51.2102 42.0725 50.8184 42.5329L44.8275 49.5733C44.5982 49.8428 44.2828 50 43.9484 50H13.621C13.0669 50 12.7898 49.214 13.1815 48.7536L19.1725 41.7132Z'
        fill='url(#paint0_linear_277_990)'
      />
      <path
        d='M19.1724 15.4267C19.4113 15.1572 19.7266 15 20.0515 15H50.3788C50.933 15 51.2101 15.786 50.8184 16.2464L44.8274 23.2868C44.5981 23.5563 44.2828 23.7135 43.9484 23.7135H13.621C13.0668 23.7135 12.7897 22.9275 13.1815 22.4671L19.1724 15.4267Z'
        fill='url(#paint1_linear_277_990)'
      />
      <path
        d='M44.8275 28.4858C44.5982 28.2163 44.2828 28.0591 43.9484 28.0591H13.621C13.0669 28.0591 12.7898 28.8451 13.1815 29.3055L19.1725 36.3459C19.4018 36.6154 19.7171 36.7726 20.0515 36.7726H50.3789C50.9331 36.7726 51.2102 35.9866 50.8184 35.5262L44.8275 28.4858Z'
        fill='url(#paint2_linear_277_990)'
      />
    </g>
    <defs>
      <linearGradient
        id='paint0_linear_277_990'
        x1='47.4818'
        y1='10.7942'
        x2='20.6824'
        y2='54.4741'
        gradientUnits='userSpaceOnUse'
      >
        <stop stopColor='#00FFA3' />
        <stop offset='1' stopColor='#DC1FFF' />
      </linearGradient>
      <linearGradient
        id='paint1_linear_277_990'
        x1='38.3042'
        y1='5.16346'
        x2='11.5048'
        y2='48.8434'
        gradientUnits='userSpaceOnUse'
      >
        <stop stopColor='#00FFA3' />
        <stop offset='1' stopColor='#DC1FFF' />
      </linearGradient>
      <linearGradient
        id='paint2_linear_277_990'
        x1='42.8638'
        y1='7.96098'
        x2='16.0644'
        y2='51.6409'
        gradientUnits='userSpaceOnUse'
      >
        <stop stopColor='#00FFA3' />
        <stop offset='1' stopColor='#DC1FFF' />
      </linearGradient>
      <clipPath id='clip0_277_990'>
        <rect
          width='38'
          height='35'
          fill='white'
          transform='translate(13 15)'
        />
      </clipPath>
    </defs>
  </svg>
);

export default SvgComponent;
