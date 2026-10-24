'use client';
import SocialAccessForm from '../components/SocialAccessForm';
import {useEffect,useState} from 'react';
import {socialAuthReturnPath} from '../components/social-auth-return.mjs';
export default function LoginPage(){
 const [destination,setDestination]=useState('/social');
 useEffect(()=>setDestination(socialAuthReturnPath(new URLSearchParams(window.location.search).get('next'))),[]);
 return <SocialAccessForm returnTo={destination}/>;
}
