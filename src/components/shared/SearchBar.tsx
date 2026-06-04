import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

export function SearchBar({ containerClassName, className, placeholder = "Buscar...", ...props }: Props) {
  // El alto/padding lo controla el contenedor InputGroup; por eso `className` (que los
  // call-sites usan para h-9/h-11/pr-*) se aplica al root. Default h-11 = alto previo del Input.
  return (
    <InputGroup className={cn("h-11", containerClassName, className)}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder={placeholder} {...props} />
    </InputGroup>
  );
}
