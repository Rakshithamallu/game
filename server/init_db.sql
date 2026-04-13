IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'GAME')
BEGIN
    CREATE DATABASE GAME;
END
GO

USE GAME;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Leaderboard]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Leaderboard](
        [Id] [int] IDENTITY(1,1) PRIMARY KEY,
        [PlayerName] [nvarchar](100) NOT NULL,
        [Wins] [int] DEFAULT 0,
        [Losses] [int] DEFAULT 0,
        [LastPlayed] [datetime] DEFAULT GETDATE()
    );
END
GO
