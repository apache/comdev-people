FROM ubuntu:20.04

RUN apt-get update \
    && apt-get --assume-yes install software-properties-common curl wget

RUN apt-get --assume-yes install \
    lua5.2 \
    liblua5.2-dev \
    lua5.2-cjson \
    lua5.2-socket \
    lua5.2-sec \
    python3-pip

RUN pip3 install ezt

WORKDIR /var/www

ENTRYPOINT ["/bin/bash"]
