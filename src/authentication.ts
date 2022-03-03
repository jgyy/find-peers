import passport from 'passport'
import { OAuth2Strategy } from 'passport-oauth'
import fetch from 'node-fetch'
import fs from 'fs'
import { env } from './env'

export function authenticate(req, res, next) {
	if (!req.user) {
		res.redirect(`/auth/${env.provider}`)
	} else {
		next()
	}
}

export interface UserProfile {
	id: number,
	login: string,
	first_name: string,
	displayname: string,
	accessToken: string,
	refreshToken: string,
}
const sessionStorePath = 'sessions'
const userDBpath = sessionStorePath + '/users.json'
const usersDB: UserProfile[] = []
const emptyUsersDB: string = JSON.stringify(usersDB)
fs.mkdirSync(sessionStorePath, { recursive: true })
if (!fs.existsSync(userDBpath) || fs.statSync(userDBpath).size < emptyUsersDB.length)
	fs.writeFileSync(userDBpath, emptyUsersDB)

const users: UserProfile[] = JSON.parse(fs.readFileSync(userDBpath).toString())


passport.serializeUser((user, done) => {
	done(null, user.id)
})

passport.deserializeUser((id, done) => {
	const user = users.find((user) => user.id === id)
	done(null, user)
})

async function getProfile(accessToken: string, refreshToken: string): Promise<UserProfile | null> {
	try {
		const response = await fetch('https://api.intra.42.fr/v2/me', {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		})
		const json = await response.json()
		return {
			id: json.id,
			login: json.login,
			first_name: json.first_name,
			displayname: json.displayname,
			accessToken,
			refreshToken,
		}
	} catch (err) { return null }
}

const client = new OAuth2Strategy({
	authorizationURL: env.authorizationURL,
	tokenURL: env.tokenURL,
	clientID: env.clientUID,
	clientSecret: env.clientSecret,
	callbackURL: env.callbackURL,
	// passReqToCallback: true
},
	async (accessToken, refreshToken, _profile, done) => { // fires when user clicked allow
		const newUser = await getProfile(accessToken, refreshToken)
		if (!newUser)
			return done('cannot get user info', null)
		let existingUser = users.find((user) => user.id === newUser.id)
		if (!existingUser) {
			users.push(newUser)
			fs.promises.writeFile(userDBpath, JSON.stringify(users))
			existingUser = newUser
		}
		done(null, existingUser);
	}
)
passport.use(env.provider, client)

export { passport }