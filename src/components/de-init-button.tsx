'use client';
 
import { deinit, isInitialized } from '../lib/nexus';
 
export default function DeinitButton({
  className,
  onDone,
}: { className?: string; onDone?: () => void }) {
  const onClick = async () => {
    await deinit();
    onDone?.();
    alert('Nexus de-initialized');
  };
  return <button className={className} onClick={onClick} disabled={!isInitialized()}>De-initialize</button>;
}