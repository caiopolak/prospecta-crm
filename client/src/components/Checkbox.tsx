import React, { useEffect, useRef } from 'react';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  indeterminate?: boolean;
};

export default function Checkbox({ indeterminate, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return <input ref={ref} type="checkbox" {...rest} />;
}
