"use client";

import type * as React from "react";
import { Avatar, type AvatarProps } from "./avatar";

export interface GitAvatarProps extends Omit<AvatarProps, "src"> {
  username: string;
}

export function GitHubAvatar({
  username,
  size = 32,
  letter,
  title,
  ...props
}: GitAvatarProps): React.JSX.Element {
  const pixelSize = typeof size === "number" ? size * 2 : 64;
  const src = `https://github.com/${username}.png?size=${pixelSize}`;

  return (
    <Avatar
      src={src}
      username={username}
      letter={letter}
      title={title ?? `@${username}`}
      size={size}
      {...props}
    />
  );
}

export function GitLabAvatar({
  username,
  size = 32,
  letter,
  title,
  ...props
}: GitAvatarProps): React.JSX.Element {
  const src = `https://gitlab.com/${username}.png`;

  return (
    <Avatar
      src={src}
      username={username}
      letter={letter}
      title={title ?? `@${username}`}
      size={size}
      {...props}
    />
  );
}

export function BitbucketAvatar({
  username,
  size = 32,
  letter,
  title,
  ...props
}: GitAvatarProps): React.JSX.Element {
  const pixelSize = typeof size === "number" ? size * 2 : 64;
  const src = `https://bitbucket.org/account/${username}/avatar/${pixelSize}/`;

  return (
    <Avatar
      src={src}
      username={username}
      letter={letter}
      title={title ?? `@${username}`}
      size={size}
      {...props}
    />
  );
}

GitHubAvatar.displayName = "GitHubAvatar";
GitLabAvatar.displayName = "GitLabAvatar";
BitbucketAvatar.displayName = "BitbucketAvatar";
