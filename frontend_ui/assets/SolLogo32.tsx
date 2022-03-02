type Props = {
  [key: string]: any;
};
const SvgComponent = (props: Props) => (
  <svg
    width='32'
    height='32'
    viewBox='0 0 32 32'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    {...props}
  >
    <rect width='32' height='32' rx='16' fill='black' />
    <g clip-path='url(#clip0_277_970)'>
      <path
        d='M9.58623 20.8567C9.70089 20.7219 9.85855 20.6433 10.0258 20.6433H25.1895C25.4665 20.6433 25.6051 21.0363 25.4092 21.2665L22.4137 24.7867C22.2991 24.9215 22.1414 25.0001 21.9742 25.0001H6.81052C6.53343 25.0001 6.39488 24.6071 6.59076 24.3769L9.58623 20.8567Z'
        fill='url(#paint0_linear_277_970)'
      />
      <path
        d='M9.58623 7.71335C9.70567 7.5786 9.86333 7.5 10.0258 7.5H25.1895C25.4665 7.5 25.6051 7.89301 25.4092 8.1232L22.4137 11.6434C22.2991 11.7782 22.1414 11.8568 21.9742 11.8568H6.81052C6.53343 11.8568 6.39488 11.4637 6.59076 11.2336L9.58623 7.71335Z'
        fill='url(#paint1_linear_277_970)'
      />
      <path
        d='M22.4137 14.2429C22.2991 14.1081 22.1414 14.0295 21.9742 14.0295H6.81052C6.53343 14.0295 6.39488 14.4225 6.59076 14.6527L9.58623 18.1729C9.70089 18.3077 9.85855 18.3863 10.0258 18.3863H25.1895C25.4665 18.3863 25.6051 17.9933 25.4092 17.7631L22.4137 14.2429Z'
        fill='url(#paint2_linear_277_970)'
      />
    </g>
    <defs>
      <linearGradient
        id='paint0_linear_277_970'
        x1='23.7409'
        y1='5.39718'
        x2='10.3412'
        y2='27.2371'
        gradientUnits='userSpaceOnUse'
      >
        <stop stop-color='#00FFA3' />
        <stop offset='1' stop-color='#DC1FFF' />
      </linearGradient>
      <linearGradient
        id='paint1_linear_277_970'
        x1='19.1521'
        y1='2.58173'
        x2='5.75242'
        y2='24.4217'
        gradientUnits='userSpaceOnUse'
      >
        <stop stop-color='#00FFA3' />
        <stop offset='1' stop-color='#DC1FFF' />
      </linearGradient>
      <linearGradient
        id='paint2_linear_277_970'
        x1='21.4319'
        y1='3.98049'
        x2='8.0322'
        y2='25.8204'
        gradientUnits='userSpaceOnUse'
      >
        <stop stop-color='#00FFA3' />
        <stop offset='1' stop-color='#DC1FFF' />
      </linearGradient>
      <clipPath id='clip0_277_970'>
        <rect
          width='19'
          height='17.5'
          fill='white'
          transform='translate(6.5 7.5)'
        />
      </clipPath>
    </defs>
  </svg>
);

export default SvgComponent;
