type Props = {
  [key: string]: any;
};
const SvgComponent = (props: Props) => (
  <svg
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    {...props}
  >
    <path
      fill-rule='evenodd'
      clip-rule='evenodd'
      d='M12 4V7C12 7 12 8 11 8C10 8 10 7 10 7V3C10 2.44772 10.4477 2 11 2H21C21.5523 2 22 2.44772 22 3V13C22 13.5523 21.5523 14 21 14H17C17 14 16 14 16 13C16 12 17 12 17 12H20V4H12ZM4 20V12H12V20H4ZM2 11C2 10.4477 2.44772 10 3 10H13C13.5523 10 14 10.4477 14 11V21C14 21.5523 13.5523 22 13 22H3C2.44772 22 2 21.5523 2 21V11Z'
      fill='white'
    />
  </svg>
);

export default SvgComponent;
