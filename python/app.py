from fastapi import FastAPI, HTTPException # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from pydantic import BaseModel # type: ignore
import httpx # type: ignore
import jwt # type: ignore
import os
from dotenv import load_dotenv # type: ignore

load_dotenv()

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DerivAuthCode(BaseModel):
    code: str

class DerivClient:
    def __init__(self):
        self.app_id = os.getenv('DERIV_APP_ID')
        self.app_secret = os.getenv('DERIV_APP_SECRET')
        self.api_url = 'https://api.deriv.com'
        self.oauth_url = 'https://oauth.deriv.com/oauth2/token'

    async def get_access_token(self, code: str):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.oauth_url,
                data={
                    'grant_type': 'authorization_code',
                    'client_id': self.app_id,
                    'client_secret': self.app_secret,
                    'code': code
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get access token")
            
            return response.json()['access_token']

    async def get_user_info(self, access_token: str):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_url,
                json={
                    "get_account_status": 1,
                    "req_id": "1"
                },
                headers={'Authorization': f'Bearer {access_token}'}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get user info")
            
            return response.json()

deriv_client = DerivClient()

@app.post("/deriv/auth")
async def deriv_auth(auth_code: DerivAuthCode):
    try:
        # Get access token
        access_token = await deriv_client.get_access_token(auth_code.code)
        
        # Get user info
        user_info = await deriv_client.get_user_info(access_token)
        
        # Create JWT token
        token = jwt.encode(
            {
                'deriv_id': user_info['account_status']['client_id'],
                'email': user_info['account_status']['email']
            },
            os.getenv('JWT_SECRET'),
            algorithm='HS256'
        )
        
        return {
            'token': token,
            'deriv_id': user_info['account_status']['client_id'],
            'email': user_info['account_status']['email'],
            'name': user_info['account_status']['name']
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 