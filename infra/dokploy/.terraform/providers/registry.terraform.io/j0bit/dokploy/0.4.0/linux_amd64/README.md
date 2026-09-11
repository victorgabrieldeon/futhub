# Terraform Provider for Dokploy

This is a Terraform provider for [Dokploy](https://dokploy.com/), allowing you to manage Dokploy resources such as projects using Terraform.

## Requirements

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.0
- [Go](https://golang.org/doc/install) >= 1.24

## Building The Provider

1. Clone the repository
2. Enter the repository directory
3. Build the provider:

```shell
go build .
```

## Documentation

Documentation is generated using `tfplugindocs` and can be found in the `docs` folder.

To view the documentation locally or generate it:

```shell
make generate
```

## Developing the Provider

If you wish to work on the provider, you'll first need [Go](http://www.golang.org) installed on your machine.

To compile the provider, run `go install` or `go build`.

To run acceptance tests, first create a `.env` file from the template and fill in your details:

```shell
cp .env.example .env
# Edit .env and set DOKPLOY_HOST, DOKPLOY_API_KEY, and TF_ACC=1
```

Then run the tests:

```shell
go test -v ./...
```
