export const UsernameRegex = new RegExp(/(?<!\w)([A-Za-z0-9!@#$\-_.,]){3,20}(?!\w)/)

export const UserPasswordRegex = new RegExp(/([A-Za-z0-9!@#$%^&*]){8,30}/)

export const RoomNameRegex = new RegExp(/(?<!\w)([A-Za-z0-9!@#$\-_.,]){3,20}(?!\w)/)

export const RoomPasswordRegex = new RegExp(/([A-Za-z0-9!@#$%^&*]){3,30}/)