type Props = {
  [key: string]: any;
};
const SvgComponent = (props: Props) => (
  <svg
    width='16'
    height='16'
    viewBox='0 0 16 16'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    {...props}
  >
    <circle cx='8' cy='8' r='8' fill='url(#paint0_linear_794_1144)' />
    <rect x='4' y='4' width='2' height='6' fill='white' />
    <rect x='10' y='4' width='2' height='6' fill='white' />
    <path d='M12 7.33341L4 4.66675V6.66675L12 9.33341V7.33341Z' fill='white' />
    <rect x='7' y='4' width='2' height='8' fill='white' />
    <defs>
      <linearGradient
        id='paint0_linear_794_1144'
        x1='2.66667'
        y1='2.16667'
        x2='13.5'
        y2='13.8333'
        gradientUnits='userSpaceOnUse'
      >
        <stop stop-color='#2D91EF' />
        <stop offset='1' stop-color='#3E54E8' />
      </linearGradient>
    </defs>
  </svg>
);

export default SvgComponent;
