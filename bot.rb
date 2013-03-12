#!/usr/bin/env ruby

require 'rubygems'
require 'daemons'
require 'cinch'
require './modules/plug_bot.rb'

# Determines if the current directory is fucked up and fixes it if it is
# @return [Boolean] true, if the directory was fixed.  false, if it didn't need to be fixed
def fix_dir?
  if Dir.pwd.match(/(unreachable)/)
    PlugBot.log "directory unreachable.  attempting to correct from #{Dir.pwd}."
    Dir.chdir Dir.pwd.gsub(/\(unreachable\)/, "").gsub(/\/\//, "/")
    true
  else
    false
  end
end

#Let's get this party started

begin
  Daemons.run_proc("bot", dir_mode: :script, dir: "store", backtrace: true, log_output: true, monitor: true) do
    Plug::Logger.log "daemon started"
    Headless.ly do
      @bot = Cinch::Bot.new do
        configure do |conf|
          Plug::Logger.log "configuring IRC bot"

          conf.nick = "DJ-RuB"
          conf.server = "irc.teamavolition.com"
          conf.channels = ["#radio"]
        end

        on :join do |e|
          Plug::Logger.log_channel = @bot.channels.select{ |chan| chan.name == "#radio" }.first if e.channel == "#radio"
        end

        on :message do |e|
          p e
          if e.user.nick != @bot.nick #ignore messages from the bot
            # if message.match /^DJ-RuB/
            # else
            # end
          end
        end

        on :connect do |e|
          Plug::Logger.log "connected to IRC"
          Plug::Logger.log "initiating browser loop"
          Plug::Bot.start_browser_loop
        end
      end

      Plug::Logger.log "connecting to IRC"
      @bot.start
    end
  end
rescue Exception => e
  Plug::Logger.log e
  Plug::Bot.clean_up
end
