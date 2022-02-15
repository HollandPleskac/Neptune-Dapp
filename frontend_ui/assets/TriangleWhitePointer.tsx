type Props = {
  [key: string]: any;
};
const SvgComponent = (props: Props) => (
  <svg
    width="7"
    height="7"
    viewBox="0 0 7 7"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M6.81472 7H0.703613L3.75917 0L6.81472 7Z" fill="white" />
  </svg>
);

export default SvgComponent;
