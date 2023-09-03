import { useLocation } from 'preact-iso';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { Header } from '../../components/Header.jsx';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import Typography from '@mui/material/Typography';

export function Placeholder() {
  const { url } = useLocation();
  const title = {
    '/search': 'Search for items',
    '/plan': 'Plan the next shop',
    '/shop': 'Buy some stuff'
  }[url];
  const Icon = {
    '/search': SearchIcon,
    '/plan': ShoppingCartIcon,
    '/shop': CheckBoxIcon
  }[url] || (() => null);

  return (
    <>
      <Header>
        <Icon sx={{ mr: 1 }} />
        <Typography variant="h6" component="div">{ title }</Typography>
      </Header>
      <Container maxWidth="sm">
        Coming soon
      </Container>
    </>
  );
}
